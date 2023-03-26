const { stringify } = JSON;

/**
 * Make a request using "gpt-3.5-turbo" model
 * @param {({ name?: string; role: 'user' | 'system' | 'assistant'; content: string })[]} messages
 */
const request = async (...messages) => {
  const request = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_TOKEN}`,
    },
    body: stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
    }),
  });

  return request.json();
};

export { request };
