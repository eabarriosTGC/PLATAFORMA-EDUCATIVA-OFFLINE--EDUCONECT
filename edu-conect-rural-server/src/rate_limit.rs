//! Rate limiter en memoria — sin dependencias externas.
//!
//! Usa `HashMap<String, Vec<Instant>>` detrás de un `tokio::sync::Mutex`.
//! Limpia entradas viejas en cada chequeo para no acumular memoria.
//!
//! Uso típico: máximo 5 intentos de login por IP en 60 segundos.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

pub struct RateLimiter {
    /// Clave → timestamps de intentos (los más viejos primero).
    buckets: Mutex<HashMap<String, Vec<Instant>>>,
    /// Ventana de tiempo en la que se cuentan los intentos.
    window: Duration,
    /// Máximo número de intentos permitidos en la ventana.
    max_requests: usize,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            buckets: Mutex::new(HashMap::new()),
            window: Duration::from_secs(window_secs),
            max_requests,
        }
    }

    /// Retorna `true` si la clave NO ha excedido el límite.
    /// Como efecto lateral registra el intento.
    ///
    /// Thread-safe: usa `Mutex` asíncrono de tokio.
    pub async fn check(&self, key: &str) -> bool {
        let mut buckets = self.buckets.lock().await;
        let now = Instant::now();
        let deadline = now - self.window;
        let entry = buckets.entry(key.to_string()).or_default();

        // Podar timestamps fuera de la ventana
        entry.retain(|t| *t > deadline);

        if entry.len() >= self.max_requests {
            return false;
        }

        entry.push(now);
        true
    }

    /// Solo para tests: resetea el estado.
    #[cfg(test)]
    pub async fn reset(&self) {
        self.buckets.lock().await.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_allows_under_limit() {
        let rl = RateLimiter::new(5, 60);
        for _ in 0..5 {
            assert!(rl.check("127.0.0.1").await, "debería permitir intento dentro del límite");
        }
    }

    #[tokio::test]
    async fn test_rate_limiter_blocks_over_limit() {
        let rl = RateLimiter::new(3, 60);
        for _ in 0..3 {
            assert!(rl.check("127.0.0.1").await);
        }
        // El 4to intento debe ser bloqueado
        assert!(!rl.check("127.0.0.1").await, "debería bloquear el 4to intento");
    }

    #[tokio::test]
    async fn test_rate_limiter_independent_keys() {
        let rl = RateLimiter::new(2, 60);
        assert!(rl.check("10.0.0.1").await);
        assert!(rl.check("10.0.0.1").await);
        assert!(!rl.check("10.0.0.1").await); // IP 1 bloqueada
        assert!(rl.check("10.0.0.2").await);  // IP 2 sin bloquear
        assert!(rl.check("10.0.0.2").await);
        assert!(!rl.check("10.0.0.2").await); // IP 2 ahora bloqueada
    }

    #[tokio::test]
    async fn test_rate_limiter_concurrent() {
        use std::sync::Arc;
        let rl = Arc::new(RateLimiter::new(10, 60));
        let mut handles = vec![];
        for i in 0..20 {
            let rl = rl.clone();
            let ip = format!("10.0.0.{}", i % 5);
            handles.push(tokio::spawn(async move { rl.check(&ip).await }));
        }
        for h in handles {
            h.await.unwrap();
        }
        // No debería haber panics ni deadlocks
    }
}
