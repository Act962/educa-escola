import { z } from "zod";

export const academicYear = z.number().int().min(2000).max(2100);

export const profileInput = z.object({ academicYear });

export type ProfileInput = z.infer<typeof profileInput>;
