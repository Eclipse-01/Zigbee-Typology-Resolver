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

    // 仅支持智谱（Zhipu / BigModel）GLM-4.5-Flash
    const provider = 'zhipu';
    const apiUrl = process.env.AI_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const model = request.body.model || process.env.AI_MODEL || 'glm-4.5-flash';

    // 允许前端传入其他参数（例如 temperature, max_tokens, thinking 等），默认从环境读取
    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
    };
    if (request.body.max_tokens) payload.max_tokens = request.body.max_tokens;
    if (request.body.temperature) payload.temperature = request.body.temperature;
    if (request.body.top_p) payload.top_p = request.body.top_p;
    if (request.body.thinking) payload.thinking = request.body.thinking; // GLM-specific

    // 发送到相应的 AI API
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!aiResponse.ok) {
      // 如果 AI 服务返回错误，将错误信息传递给前端
      const errorData = await aiResponse.json().catch(() => ({ message: 'Unknown error' }));
      console.error('AI API Error:', errorData);
      return response.status(aiResponse.status).json({ message: 'Failed to get response from AI service.', details: errorData, provider });
    }

    const aiData = await aiResponse.json();

    // 尝试解析回复文本（兼容常见结构）
    let aiText = '';
    if (aiData?.choices?.[0]?.message?.content) {
      aiText = aiData.choices[0].message.content;
    } else if (aiData?.choices?.[0]?.delta?.content) {
      aiText = aiData.choices[0].delta.content;
    } else if (aiData?.data?.[0]?.content) {
      aiText = aiData.data[0].content;
    } else if (aiData?.result?.choices?.[0]?.message?.content) {
      aiText = aiData.result.choices[0].message.content;
    } else {
      // 回退到原始数据（字符串化），避免前端拿不到任何信息
      aiText = JSON.stringify(aiData).slice(0, 2000);
    }

    // 将 AI 的回复成功返回给前端，同时返回 provider 信息，便于调试
    response.status(200).json({ provider, model, text: aiText, raw: aiData });

  } catch (error) {
    console.error('Internal Server Error:', error);
    response.status(500).json({ message: 'An internal server error occurred.' });
  }
}
