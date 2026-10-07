declare global {
  namespace App {
    interface Locals {
      requestId: string;
      /** The caller's participant id, if their credential cookie resolves to one. */
      participantId: string | null;
    }
  }
}

export {};
