-- CreateTable
CREATE TABLE "prediction_translations" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "fieldName" VARCHAR(50) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "translatedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_translations" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "translatedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prediction_translations_predictionId_fieldName_language_key" ON "prediction_translations"("predictionId", "fieldName", "language");

-- CreateIndex
CREATE UNIQUE INDEX "comment_translations_commentId_language_key" ON "comment_translations"("commentId", "language");

-- AddForeignKey
ALTER TABLE "prediction_translations" ADD CONSTRAINT "prediction_translations_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_translations" ADD CONSTRAINT "comment_translations_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
