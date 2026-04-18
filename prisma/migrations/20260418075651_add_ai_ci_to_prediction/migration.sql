-- AlterTable: denormalized AI 95% CI bounds on Prediction so the forecast-list
-- endpoint can render the range on cards without joining ContextSnapshot.
-- Populated from the latest Oracle payload in prisma/services/context route.
ALTER TABLE "predictions" ADD COLUMN "ai_ci_low" INTEGER;
ALTER TABLE "predictions" ADD COLUMN "ai_ci_high" INTEGER;
