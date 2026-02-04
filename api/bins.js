const JSONBIN_API = 'https://jsonbin-zeta.vercel.app/api/bins';

export default async function handler(req, res) {
  const { method, body } = req;

  try {
    if (method === 'POST') {
      const response = await fetch(JSONBIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
