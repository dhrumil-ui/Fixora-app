import helmet from "helmet";
import hpp from "hpp";

export function applySecurity(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://maps.googleapis.com",
            "https://js.stripe.com",
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:", "http://localhost:5001"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(hpp());
}
