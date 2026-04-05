export async function GET() {
  return Response.json({
    mockupIds: {
      xdr: process.env.MOCKUP_ID_XDR || 'X7PbdxQKSQEqm43S',
      macbook: process.env.MOCKUP_ID_MACBOOK || 'XtWDyavzoAIcEXk2',
      ipad: process.env.MOCKUP_ID_IPAD || 'ZvL81KPA3wFkHMzO',
      iphone: process.env.MOCKUP_ID_IPHONE || 'aMfKiv4O0AF5oGLE',
    },
  });
}
