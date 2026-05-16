# Telegram Summon Flow

Telegram summon is the remote version of keyboard summon: a trusted Telegram command wakes the personal agent and creates a backend summon event.

## Goal

Let the owner send a Telegram command such as:

```text
/summon review my day
```

The Telegram adapter validates the sender, extracts the text, and calls the same backend summon API used by the local keyboard script.

## Placeholder Webhook Flow

1. Telegram sends an update to the configured webhook URL.
2. The webhook verifies the bot secret and checks that `message.from.id` is in the allowed owner list.
3. The command parser accepts `/summon` and treats the remaining text as the summon message.
4. The webhook sends:

```http
POST /api/summon
Content-Type: application/json

{
  "source": "telegram",
  "message": "review my day",
  "metadata": {
    "telegramChatId": "1699437192",
    "telegramMessageId": "123",
    "trigger": "telegram-command"
  }
}
```

5. The backend stores or dispatches the summon request.
6. The webhook replies with a concise acknowledgement after the backend accepts the request.

## Command Contract

Supported command:

```text
/summon [optional message]
```

Default message:

```text
Telegram summon requested.
```

Expected backend endpoint:

```text
POST http://localhost:8000/api/summon
```

Expected payload fields:

- `source`: `telegram`
- `message`: command text after `/summon`
- `metadata`: chat id, message id, sender id, and trigger name

## Security Notes

- Keep the Telegram bot token out of git.
- Verify the Telegram webhook secret header when using webhooks.
- Restrict summon commands to explicit owner IDs.
- Do not echo private backend state into Telegram responses.
