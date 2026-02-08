-- CreateIndex
CREATE INDEX "comments_predictionId_createdAt_idx" ON "comments"("predictionId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_forecastId_createdAt_idx" ON "comments"("forecastId", "createdAt");
