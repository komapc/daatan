-- Add language indexes to translation tables for efficient per-language queries
CREATE INDEX "prediction_translations_language_idx" ON "prediction_translations"("language");
CREATE INDEX "comment_translations_language_idx" ON "comment_translations"("language");
