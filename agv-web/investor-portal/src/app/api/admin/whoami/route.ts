import { NextRequest, NextResponse } from "next/server";
import { tryVerify, isAdminClaim, isAuthorizedAdminEmail } from "../_auth";

interface DecodedToken {
  admin?: boolean;
  role?: string;
  roles?: string[];
  email?: string;
}

export async function GET(req: NextRequest) {
  const decoded = await tryVerify(req);
  const email = decoded?.email ?? null;
  const isAdmin = !!decoded && isAdminClaim(decoded);
  const isAuthorized = !!decoded && await isAuthorizedAdminEmail(email);

  return NextResponse.json({
    authed: !!decoded,
    email,
    isAdmin: isAdmin && isAuthorized,
    isSuperAdmin: isAuthorized,
    claims: {
      role: (decoded as DecodedToken)?.role ?? null,
      roles: Array.isArray((decoded as DecodedToken)?.roles) ? (decoded as DecodedToken)!.roles : [],
      admin: (decoded as DecodedToken)?.admin === true,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({
        authed: false,
        email: null,
        isAdmin: false,
        isSuperAdmin: false,
      });
    }

    const isAuthorized = await isAuthorizedAdminEmail(email);
    
    return NextResponse.json({
      authed: true,
      email,
      isAdmin: isAuthorized,
      isSuperAdmin: isAuthorized,
      claims: {
        role: null,
        roles: [],
        admin: isAuthorized,
      },
    });
  } catch (error) {
    console.error('Error in whoami POST:', error);
    return NextResponse.json({
      authed: false,
      email: null,
      isAdmin: false,
      isSuperAdmin: false,
    });
  }
}

