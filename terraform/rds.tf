# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier = "daatan-db"

  # Engine
  engine               = "postgres"
  engine_version       = "16.4"
  instance_class       = var.rds_instance_class
  parameter_group_name = "default.postgres16"

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  # Backup
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  # Performance
  performance_insights_enabled = false

  # Deletion protection (disable for dev)
  deletion_protection      = var.environment == "prod" ? true : false
  skip_final_snapshot      = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "daatan-db-final-snapshot" : null

  tags = {
    Name = "daatan-db"
  }
}

