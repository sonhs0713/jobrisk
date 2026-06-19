const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

export async function apiFetch(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    })
  } catch (error) {
    throw new Error(`API 서버에 연결할 수 없습니다. 별도 터미널에서 npm.cmd run dev 를 실행한 뒤 다시 시도하세요. (${error.message})`)
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return data
}
