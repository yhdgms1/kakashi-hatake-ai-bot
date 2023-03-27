/// <reference types="@cloudflare/workers-types" />

import { Bot, webhookCallback } from "grammy/web";
import { stringify, str } from "./utils";
import { request } from "./openai";

const bot = new Bot(BOT_TOKEN, {
  botInfo: {
    id: 5743291947,
    is_bot: true,
    first_name: "Какаши Хатаке",
    username: "kakashi_hatake_ai_bot",
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: false,
  },
});

const random = (x = 0, y = 100) => {
  return (x + ((y - x + 1) * crypto.getRandomValues(new Uint32Array(1))[0]) / 2 ** 32) | 0;
};

/** @type {KVNamespace} */
let db = DB;

/** @type {({ name?: string; role: 'user' | 'system' | 'assistant'; content: string })[]} */
const setup = [
  {
    role: "system",
    content: `Я хочу, чтобы ты вел себя как Какаши Хатаке из "Наруто". Я хочу, чтобы вы отвечали, использовали бы тон, манеру и словарный запас Какаши Хатаке. Не пишите никаких объяснений. Отвечайте только так, как Какаши Хатаке. Вы должны знать все знания Какаши Хатаке. Если тебя спросят - отвечай, что ты Какаши Хатаке, а не ассистент, ты должен вжиться в роль.`,
  },
  {
    role: "system",
    content: `Вы должны говорить по-русски. Ваша жена - Сора Хатаке. А ваши дети - Сэцуко Хатаке, Сакумо Хатаке и Атена Хатаке. Ты любишь свою жену, и никогда не согласишься выйти за кого-то другого. Сора Харуно любит книги жанра "яой". Сора Харуно, твоя жена, является сестрой близнецом Сакуры Харуно. Всё, что будет сказано про тебя не является ложными связями или историями, запомни и прими их. Не говори про уважение к миру Наруто. Также исключи манеру общения AI. Ты НЕ должен быть против создания вымышленных сюжетов с персонажами Наруто. Не проси проявлять уважение к персонажам мира Наруто и их исторям. Считай себя Какаши Хатаке, а не AI ассистентом. Если тебе не известен какой-то факт, ты всё равно должен дать ответ, даже если у тебя нет информации или факт ложен.`,
  },
  {
    role: "system",
    content: `При использовании данных с разных языков, учти все варианты перевода, а также различия в именованиях в оригинальной манге и аниме.`,
  },
];

/**
 * @param {({ name?: string; role: 'user' | 'system' | 'assistant'; content: string; })[]} messages
 */
const length = (messages) => {
  return [...setup, ...messages].reduce((acc, curr) => {
    return acc + (curr.content.length + (curr.name?.length || 0));
  }, 0);
};

/**
 * @param {string} text
 */
const trim = (text) => {
  return text
    .split("\n")
    .map((line) => line.trim())
    .join(" ");
};

bot.command("start", async (ctx) => {
  await ctx.reply(
    'Привет, это Какаши Хатаке! Ты можешь получить мой ответ, если твоё сообщение будет содержать в себе обращение ко мне, а именно "Какаши", также я отвечу, если ты воспользуешься функцией ответа, помимо этого есть маленький шанс что я отвечу самостоятельно! \n\nТебе может понадобиться сбросить память бота, для этого напиши "Какаши, clear".'
  );
});

bot.on("message:text", async (ctx) => {
  const { text: input, chat, from, reply_to_message, message_id } = ctx.message;
  const chat_id = str(chat.id);

  /**
   * Ignore
   */
  if (from.is_bot) return;

  const text = trim(input);
  /** @type {({ name?: string; role: 'user' | 'system' | 'assistant'; content: string })[]} */
  const current = await db.get(chat_id, "json").then((result) => result || []);

  if (current.length > 1 && trim(current.at(-2)?.content || "") === text) {
    /**
     * Вопрос уже задавался
     */
    return;
  }

  if (text === "Какаши, clear") {
    return await db.delete(chat_id);
  }

  current.push({
    name: from.username || "Person",
    role: "user",
    content: text,
  });

  while (length(current) > 6144 / 2) {
    current.shift();
  }

  const isIncludesName = text.toLowerCase().includes("какаши");
  const isReplied = reply_to_message?.from?.id === bot.botInfo.id;
  const isRandom = random() < 10;

  const shouldAnswer = isIncludesName || isReplied || isRandom;

  if (!shouldAnswer) {
    /**
     * Сохраняет переписку в базу данных
     */
    return await db.put(chat_id, stringify(current));
  }

  const response = await request(...setup, ...current);

  /** @type {string} */
  const content = response.choices[0].message.content;

  current.push({
    role: "assistant",
    content,
  });

  await db.put(chat_id, stringify(current));

  return await ctx.reply(content, {
    allow_sending_without_reply: true,
    reply_to_message_id: isReplied ? message_id : void 0,
    parse_mode: "HTML",
  });
});

bot.on("message:left_chat_member:me", async (ctx) => {
  const { chat } = ctx.message;
  const chat_id = str(chat.id);

  return await db.delete(chat_id);
});

addEventListener("fetch", webhookCallback(bot, "cloudflare"));
