package com.chatsib.app.data.remote

import com.chatsib.app.core.ApiBaseUrlProvider
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/** Rewrites request host to the current API base (BuildConfig default or debug override). */
@Singleton
class DynamicBaseUrlInterceptor @Inject constructor(
    private val apiBaseUrlProvider: ApiBaseUrlProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val configured = apiBaseUrlProvider.current().trimEnd('/').toHttpUrlOrNull()
            ?: return chain.proceed(request)
        val original = request.url
        val newUrl = original.newBuilder()
            .scheme(configured.scheme)
            .host(configured.host)
            .port(configured.port)
            .build()
        return chain.proceed(request.newBuilder().url(newUrl).build())
    }
}
