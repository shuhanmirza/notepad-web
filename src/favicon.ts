interface FaviconPalette {
  background: string
  foreground: string
}

function roundedSquare(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + size - radius, y)
  context.quadraticCurveTo(x + size, y, x + size, y + radius)
  context.lineTo(x + size, y + size - radius)
  context.quadraticCurveTo(
    x + size,
    y + size,
    x + size - radius,
    y + size,
  )
  context.lineTo(x + radius, y + size)
  context.quadraticCurveTo(x, y + size, x, y + size - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

export function updateFavicon(palette: FaviconPalette) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64

  const context = canvas.getContext('2d')
  if (!context) return

  roundedSquare(context, 2, 2, 60, 13)
  context.fillStyle = palette.background
  context.fill()

  context.fillStyle = palette.foreground
  context.font =
    '800 22px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('txt', 32, 33)

  const favicon = document.querySelector<HTMLLinkElement>('#app-favicon')
  if (favicon) favicon.href = canvas.toDataURL('image/png')
}
