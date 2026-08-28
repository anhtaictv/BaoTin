import "express";

export type AuthSubjectRole = "citizen" | "officer" | "senior_officer" | "commune_head" | "admin";

export interface AuthenticatedSubject {
  id: string;
  role: AuthSubjectRole;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedSubject;
  }
}
