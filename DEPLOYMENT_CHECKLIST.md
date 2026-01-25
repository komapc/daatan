# DAATAN Deployment Checklist

Use this checklist for all deployments to ensure consistency and safety.

---

## Pre-Deployment Checklist

### Code Review
- [ ] All changes reviewed and approved
- [ ] Tests passing locally (`npm test`)
- [ ] Build successful locally (`npm run build`)
- [ ] No console errors or warnings
- [ ] Linting passes (`npm run lint`)

### Documentation
- [ ] Commit messages are clear and descriptive
- [ ] README updated if needed
- [ ] CHANGELOG updated
- [ ] API documentation updated if applicable

### Database
- [ ] No breaking schema changes
- [ ] Migrations tested locally
- [ ] Rollback plan documented
- [ ] Backup created (if production)

### Environment
- [ ] All environment variables set
- [ ] Secrets not committed to repo
- [ ] `.env` file not in git
- [ ] Configuration files reviewed

---

## Deployment Checklist

### Choose Deployment Strategy

#### Option A: Standard Deployment (Automatic)
```bash
# For staging (automatic on push to main)
git push origin main

# For production (automatic on tag)
git tag v0.1.X
git push origin v0.1.X
```

**Checklist:**
- [ ] Code pushed to correct branch
- [ ] GitHub Actions workflow triggered
- [ ] Build step completed successfully
- [ ] Tests passed in CI/CD
- [ ] Deployment step started

#### Option B: Blue-Green Deployment (Zero Downtime)
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/blue-green-deploy.sh production"
```

**Checklist:**
- [ ] SSH access verified
- [ ] Script is executable
- [ ] Environment variables set on server
- [ ] Deployment started
- [ ] Health checks passing

#### Option C: Manual Deployment (Direct SSH)
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186
cd ~/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
./scripts/verify-deploy.sh https://daatan.com
```

**Checklist:**
- [ ] SSH access working
- [ ] Git pull successful
- [ ] Docker build completed
- [ ] Containers started
- [ ] Health check passed

---

## Post-Deployment Verification

### Immediate Checks (First 5 minutes)
- [ ] Health endpoint responds: `curl https://daatan.com/api/health`
- [ ] Staging health: `curl https://staging.daatan.com/api/health`
- [ ] No error logs: `docker logs daatan-app --tail 50`
- [ ] Nginx running: `docker ps | grep nginx`
- [ ] Database connected: `docker exec daatan-postgres pg_isready`

### Functional Checks (First 15 minutes)
- [ ] Homepage loads
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] Database queries work
- [ ] No 502 errors in nginx logs

### Performance Checks (First 30 minutes)
- [ ] Page load times normal
- [ ] No memory leaks: `docker stats`
- [ ] CPU usage normal
- [ ] No stuck processes
- [ ] Response times acceptable

### Monitoring (Ongoing)
- [ ] Error rate normal
- [ ] Uptime maintained
- [ ] No unusual logs
- [ ] User reports checked
- [ ] Metrics dashboard reviewed

---

## Rollback Checklist

### If Issues Detected

**Immediate Action:**
- [ ] Stop accepting new traffic (if possible)
- [ ] Notify team
- [ ] Prepare rollback

**Execute Rollback:**
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/rollback.sh production"
```

**Checklist:**
- [ ] Rollback script executed
- [ ] Health checks passed
- [ ] Services back online
- [ ] Previous version confirmed
- [ ] Team notified

**Post-Rollback:**
- [ ] Investigate root cause
- [ ] Document issue
- [ ] Fix in code
- [ ] Test thoroughly
- [ ] Plan re-deployment

---

## Deployment Scenarios

### Scenario 1: Regular Feature Deployment
1. [ ] Code reviewed and approved
2. [ ] Tests passing
3. [ ] Push to main (staging auto-deploys)
4. [ ] Verify staging health
5. [ ] Create version tag for production
6. [ ] Verify production health
7. [ ] Monitor for 30 minutes

### Scenario 2: Hotfix Deployment
1. [ ] Create hotfix branch
2. [ ] Fix issue
3. [ ] Tests passing
4. [ ] Code reviewed
5. [ ] Merge to main
6. [ ] Deploy to staging
7. [ ] Verify staging
8. [ ] Create hotfix tag (v0.1.X-hotfix)
9. [ ] Deploy to production
10. [ ] Monitor closely

### Scenario 3: Database Migration
1. [ ] Migration tested locally
2. [ ] Backup created
3. [ ] Rollback plan documented
4. [ ] Deploy code with migration
5. [ ] Monitor database performance
6. [ ] Verify data integrity
7. [ ] Document changes

### Scenario 4: Emergency Rollback
1. [ ] Identify issue
2. [ ] Execute rollback script
3. [ ] Verify services online
4. [ ] Notify stakeholders
5. [ ] Investigate root cause
6. [ ] Plan fix
7. [ ] Re-deploy when ready

---

## Communication Checklist

### Before Deployment
- [ ] Team notified of planned deployment
- [ ] Maintenance window scheduled (if needed)
- [ ] Stakeholders informed
- [ ] Rollback plan shared

### During Deployment
- [ ] Status updates provided
- [ ] Issues reported immediately
- [ ] Team available for support
- [ ] Monitoring active

### After Deployment
- [ ] Success confirmed
- [ ] Team notified
- [ ] Monitoring continued
- [ ] Lessons documented

---

## Common Issues & Solutions

### Issue: Health Check Fails
**Solution:**
1. Check logs: `docker logs daatan-app --tail 50`
2. Verify database: `docker exec daatan-postgres pg_isready`
3. Check environment variables
4. Restart container: `docker compose restart app`
5. If persists, rollback

### Issue: High Memory Usage
**Solution:**
1. Check memory: `docker stats`
2. Restart container: `docker compose restart app`
3. Check for memory leaks in logs
4. If persists, rollback

### Issue: Database Connection Error
**Solution:**
1. Check postgres: `docker ps | grep postgres`
2. Verify connection: `docker exec daatan-postgres pg_isready`
3. Restart postgres: `docker compose restart postgres`
4. Check disk space: `df -h`
5. If persists, rollback

### Issue: Nginx 502 Errors
**Solution:**
1. Check nginx config: `docker exec daatan-nginx nginx -t`
2. Check app containers: `docker ps | grep app`
3. Verify app health: `docker logs daatan-app --tail 50`
4. Reload nginx: `docker exec daatan-nginx nginx -s reload`
5. If persists, rollback

---

## Sign-Off

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verified By:** _______________  
**Environment:** [ ] Staging [ ] Production  
**Version:** _______________  

**Notes:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Issues Encountered:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

**Resolution:**
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Quick Reference

### Health Checks
```bash
# Production
curl https://daatan.com/api/health

# Staging
curl https://staging.daatan.com/api/health
```

### Logs
```bash
# App logs
docker logs daatan-app --tail 100 -f

# Nginx logs
docker logs daatan-nginx --tail 100 -f

# Database logs
docker logs daatan-postgres --tail 100 -f
```

### Container Status
```bash
# All containers
docker ps -a

# Specific container
docker ps | grep daatan-app
```

### Rollback
```bash
./scripts/rollback.sh production
./scripts/rollback.sh staging
```

---

**Last Updated:** January 25, 2026  
**Version:** 1.0
