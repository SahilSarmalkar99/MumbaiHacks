export const sendMessageToAgent = async (conversation: any[]) => {
  try {
    const response = await fetch("http://localhost:8000/agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: conversation[conversation.length - 1].content }),
    });

    const data = await response.json();

    return data.reply;
  } catch (error) {
    console.error("Agent error:", error);
    throw error;
  }
};
