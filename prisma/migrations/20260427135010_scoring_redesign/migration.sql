-- AlterTable
ALTER TABLE "_PredictionToTag" ADD CONSTRAINT "_PredictionToTag_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PredictionToTag_AB_unique";
