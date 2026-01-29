# PR Quality Requirements

## Before Creating Any PR
ALWAYS run these checks locally before pushing:

1. **Run tests**: `npm test`
2. **Run build**: `npm run build`
3. **Run linter**: `npm run lint`

## Zero Tolerance for Errors
- PRs must have 0 test failures
- PRs must have 0 build errors
- Fix any issues before creating the PR

## If Tests Fail
1. Read the error message carefully
2. Fix the code or update the test
3. Re-run tests to confirm fix
4. Only then create the PR

## Quick Check Command
```bash
npm test && npm run build && npm run lint
```
