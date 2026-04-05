export async function GET() {
  return Response.json({
    mockupIds: {
      xdr: process.env.MOCKUP_ID_XDR || 'X7PbdxQKSQEqm43S',
      macbook: process.env.MOCKUP_ID_MACBOOK || 'Z6NUCWxg1wFjtBDe',
      ipad: process.env.MOCKUP_ID_IPAD || 'YXFDGB-dzQLH4wEz',
      iphone: process.env.MOCKUP_ID_IPHONE || 'XtWDyavzoAIcEXmZ',
    },
  });
}
