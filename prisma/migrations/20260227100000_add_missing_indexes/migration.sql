-- AddIndex: Commitment(userId, cuReturned) for leaderboard aggregation
CREATE INDEX "commitments_userId_cuReturned_idx" ON "commitments"("userId", "cuReturned");

-- AddIndex: BotRunLog(botId, action, isDryRun, runAt) for admin bot-log queries
CREATE INDEX "bot_run_logs_botId_action_isDryRun_runAt_idx" ON "bot_run_logs"("botId", "action", "isDryRun", "runAt");
