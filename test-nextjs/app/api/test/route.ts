export async function GET() {
  return Response.json({
    message: 'API route working!',
    timestamp: new Date().toISOString()
  });
}
