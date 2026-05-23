package com.chatsib.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.data.session.SessionManager
import com.chatsib.app.ui.navigation.AppNavHost
import com.chatsib.app.ui.theme.ChatSibTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ChatSibTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = ElementColors.AppBackground.background,
                ) {
                    AppNavHost(sessionManager = sessionManager)
                }
            }
        }
    }
}
