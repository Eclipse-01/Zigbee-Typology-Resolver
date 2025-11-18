// api/chat.js

// 导出处理函数，Vercel 会将这个文件部署为一个 Serverless Function
// 我们可以通过访问 /api/chat 来调用它
export default async function handler(request, response) {
  // 只允许 POST 请求
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 从前端发送的请求体中获取 prompt
    const { prompt } = request.body;

    if (!prompt) {
      return response.status(400).json({ message: 'Prompt is required' });
    }

    // 从 Vercel 的环境变量中安全地获取 API 密钥
    // !! 重要 !! 请在 Vercel 项目设置中添加名为 'AI_API_KEY' 的环境变量
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
        // 不要在生产环境中暴露此错误信息
        console.error('API key is not configured.');
        return response.status(500).json({ message: 'Server configuration error.' });
    }

    // 这里以调用 OpenAI API 为例
    // 您可以替换成任何其他 AI 服务的 API 调用
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // 或者您想使用的模型
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResponse.ok) {
      // 如果 AI 服务返回错误，将错误信息传递给前端
      const errorData = await aiResponse.json();
      console.error('AI API Error:', errorData);
      return response.status(aiResponse.status).json({ message: 'Failed to get response from AI service.', details: errorData });
    }

    const aiData = await aiResponse.json();

    // 将 AI 的回复成功返回给前端
    response.status(200).json(aiData);

  } catch (error) {
    console.error('Internal Server Error:', error);
    response.status(500).json({ message: 'An internal server error occurred.' });
  }
}
