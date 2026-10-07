export class MissingDatabaseError extends Error {
  constructor() {
    super("DATABASE_URL no está configurada. Revisa SETUP.md.");
  }
}
