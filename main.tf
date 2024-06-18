terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
    archive = {
      source  = "hashicorp/archive"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Activate the needed apis
resource "google_project_service" "iam_api" {
  service = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "eventarc_api" {
  service = "eventarc.googleapis.com"
  disable_on_destroy = false
}
resource "google_project_service" "pub_sub_api" {
  service = "pubsub.googleapis.com"
  disable_on_destroy = false
}
#For Log bucket
resource "google_project_service" "logging_api" {
  service = "logging.googleapis.com"
  disable_on_destroy = false
}
data "google_project" "project" {
  project_id =  var.project_id
}

resource "google_service_account" "custom_service_account" {
  account_id   = "dataform-assertion-alerts"
  display_name = "Serverside Google Tagmanager"
  depends_on = [ google_project_service.iam_api ]
}

resource "google_project_iam_member" "sa_add_roles" {
  for_each = toset([
    "roles/run.invoker",
    "roles/cloudfunctions.invoker",
    "roles/cloudfunctions.serviceAgent"
    ])
  project = var.project_id
  role = each.value
  member = "serviceAccount:${google_service_account.custom_service_account.email}"
  depends_on = [ google_service_account.custom_service_account ]
}

# Pub/sub topic for our log sink
resource "google_pubsub_topic" "dataform_logs" {
  name    = "dataform_logs"
  project = var.project_id
  depends_on = [ google_project_service.pub_sub_api ]
}
resource "google_logging_project_sink" "dataform_log_sink" {
  name        = "dataform_log_sink"
  destination = "pubsub.googleapis.com/projects/${var.project_id}/topics/dataform_logs"
  filter = var.error_log_filter
  depends_on = [ google_pubsub_topic.dataform_logs, google_project_service.logging_api ]
}
# Add log sink service account to pub/sub topic and provide pub/sub publish rights
resource "google_pubsub_topic_iam_member" "pubsub_topic_add_sa" {
  project = var.project_id
  topic = google_pubsub_topic.dataform_logs.name
  role = "roles/pubsub.publisher"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-logging.iam.gserviceaccount.com"
  depends_on = [ google_logging_project_sink.dataform_log_sink ]
}

#Grant pub/sub standard service account access to serviceAccountTokenCreator
resource "google_project_iam_binding" "project_binding_pubsub" {
  provider = google-beta
  project  = var.project_id
  role     = "roles/iam.serviceAccountTokenCreator"
  members = ["serviceAccount:service-${data.google_project.project.number}@gcp-sa-pubsub.iam.gserviceaccount.com"]
  depends_on = [ google_project_service.pub_sub_api ]
}
# We create Cloud Storage Bucket
resource "google_storage_bucket" "bucket" {
  name     = var.google_storage_bucket_name
  location = "EU"
}
data "archive_file" "cloud_function_zip" {
  type        = "zip"
  source_dir  = "${path.module}/cloud_function"
  output_path = "${path.module}/cloud_function/cloud_function.zip"
  excludes = ["node_modules"]
}

# Upload the Cloud Function source file
resource "google_storage_bucket_object" "source_files" {
  name   = "cloud_function_src"
  bucket = google_storage_bucket.bucket.name
  source = "${path.module}/cloud_function/cloud_function.zip"
  depends_on = [ google_storage_bucket.bucket, data.archive_file.cloud_function_zip ]
}
resource "google_cloudfunctions_function" "send_slack_alert" {
  name        = "send_slack_alert"
  description = "Sends an alert to Slack whenever an assertion fails. Triggered by a log sink."
  service_account_email = google_service_account.custom_service_account.email
  runtime     = "nodejs20"
  region = var.region
  available_memory_mb   = 256
  source_archive_bucket = google_storage_bucket.bucket.name
  source_archive_object = google_storage_bucket_object.source_files.name
   event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.dataform_logs.id
  }
  entry_point           = "send_alert"
  depends_on = [ google_storage_bucket_object.source_files ]
}