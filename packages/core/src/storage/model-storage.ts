import type { Model } from '../schemas/model'

/**
 * Storage abstraction for the xomda Model. Implementations may persist to the
 * filesystem, a database, an in-memory store, or any other backend, as long as
 * they preserve `Model` validity (typically by parsing through `ModelSchema`).
 */
export interface ModelStorage {
  /**
   * Read the current model. Implementations should return a valid `Model`
   * even when no model has been written yet (typically by parsing an empty
   * object through `ModelSchema` to apply defaults).
   */
  read(): Promise<Model>

  /**
   * Persist the given model and return the stored result. Implementations
   * should stamp `updatedAt` and may apply other normalization.
   */
  write(model: Model): Promise<Model>
}
