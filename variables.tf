variable "project_id" {
  description = "The project ID in which the stack is being deployed"
  type        = string
}

variable "region" {
  description = "The name of the region to deploy within"
  type        = string
}

variable "error_log_filter" {
  description = "The SQL statement to filter the logs for"
  type = string
}

variable "google_storage_bucket_name" {
    description = "The unique name of the google storage bucket"
    type = string
}
#not_used
variable "slack_webhook" {
    description = "The URL of the Slack Webhook"
    type = string
}