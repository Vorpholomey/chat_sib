package com.chatsib.app.di

import com.chatsib.app.core.ApiBaseUrlProvider
import com.chatsib.app.data.local.ApiSettingsStore
import com.chatsib.app.data.remote.AuthApi
import com.chatsib.app.data.remote.AuthInterceptor
import com.chatsib.app.data.remote.DynamicBaseUrlInterceptor
import com.chatsib.app.data.remote.ChatsReadApi
import com.chatsib.app.data.remote.MessagesApi
import com.chatsib.app.data.remote.ModerationApi
import com.chatsib.app.data.remote.PrivateApi
import com.chatsib.app.data.remote.UploadApi
import com.chatsib.app.data.remote.UsersApi
import com.chatsib.app.data.remote.RefreshAuthApi
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.create
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
    }

    @Provides
    @Singleton
    fun provideJson(): Json = json

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor =
        HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

    @Provides
    @Singleton
    @RefreshClient
    fun provideRefreshOkHttpClient(
        logging: HttpLoggingInterceptor,
        dynamicBaseUrl: DynamicBaseUrlInterceptor,
    ): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(dynamicBaseUrl)
            .addInterceptor(logging)
            .build()

    @Provides
    @Singleton
    fun provideRefreshAuthApi(
        @RefreshClient client: OkHttpClient,
        apiBaseUrlProvider: ApiBaseUrlProvider,
    ): RefreshAuthApi = Retrofit.Builder()
        .baseUrl(apiBaseUrlProvider.current() + "/")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        logging: HttpLoggingInterceptor,
        authInterceptor: AuthInterceptor,
        dynamicBaseUrl: DynamicBaseUrlInterceptor,
    ): OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(dynamicBaseUrl)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()

    @Provides
    @Singleton
    fun provideRetrofit(
        client: OkHttpClient,
        apiBaseUrlProvider: ApiBaseUrlProvider,
    ): Retrofit =
        Retrofit.Builder()
            .baseUrl(apiBaseUrlProvider.current() + "/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create()

    @Provides
    @Singleton
    fun providePrivateApi(retrofit: Retrofit): PrivateApi = retrofit.create()

    @Provides
    @Singleton
    fun provideUsersApi(retrofit: Retrofit): UsersApi = retrofit.create()

    @Provides
    @Singleton
    fun provideUploadApi(retrofit: Retrofit): UploadApi = retrofit.create()

    @Provides
    @Singleton
    fun provideMessagesApi(retrofit: Retrofit): MessagesApi = retrofit.create()

    @Provides
    @Singleton
    fun provideChatsReadApi(retrofit: Retrofit): ChatsReadApi = retrofit.create()

    @Provides
    @Singleton
    fun provideModerationApi(retrofit: Retrofit): ModerationApi = retrofit.create()
}
