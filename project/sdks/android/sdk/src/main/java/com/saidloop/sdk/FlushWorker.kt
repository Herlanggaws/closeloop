package com.saidloop.sdk

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Sends queued reports once the device is online; retries with backoff. */
class FlushWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        val cfg = Saidloop.config ?: Saidloop.restoreConfig(applicationContext) ?: return Result.success()
        val queue = Saidloop.queue(applicationContext)
        val client = IngestClient(cfg.api, cfg.key)
        var retry = false
        for (report in queue.list()) {
            try {
                client.send(report, queue.screenshot(report.id))
                queue.remove(report.id)
            } catch (e: IngestClient.ApiException) {
                if (e.permanent) queue.remove(report.id) else retry = true
            } catch (_: Exception) {
                retry = true
            }
        }
        return if (retry) Result.retry() else Result.success()
    }

    companion object {
        private const val NAME = "saidloop-flush"

        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<FlushWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
