// OUTLIER deploy preflight. No network, tokens, or server secrets are sent.
// Static readiness and genuine remote verification must NEVER be conflated.
const expected=[
  "20261112001800_v17_private_party_rooms.sql",
  "20261112001900_v18_party_readiness.sql",
  "20261112002000_v19_room_competition.sql",
  "20261112002100_v19_exhibition_normalization.sql"
];
export const REQUIRED_ONLINE_MIGRATIONS=Object.freeze(expected);
export function assessHostedLaunch(input={}){
  const url=String(input.url||"");
  const key=String(input.publishableKey||"");
  const urlValid=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
  // anon/publishable keys are public identifiers, not proof of remote access.
  const keyPresent=key.length>20&&!/\s/.test(key);
  const files=Array.isArray(input.migrations)?input.migrations:[];
  const missingMigrations=expected.filter(m=>!files.includes(m));
  const scriptPresent=input.edgeFunctionPresent===true;
  const catalogReady=input.separateExhibitionCatalogReviewed===true;
  const authVerified=input.authenticationTested===true;
  const edgeVerified=input.edgeEndpointTested===true;
  const browserVerified=input.crossDeviceTested===true;
  const blocks=[];
  if(!urlValid||!keyPresent)blocks.push("Supabase URL and public anon/publishable key must be configured.");
  if(missingMigrations.length)blocks.push("Missing database migrations: "+missingMigrations.join(", "));
  if(!scriptPresent)blocks.push("Authenticated Edge Function source not found.");
  if(!catalogReady)blocks.push("Separate private exhibition catalog has not been reviewed and imported by an authorized owner.");
  if(!authVerified)blocks.push("Real two-account sign-in and origin redirects remain unverified.");
  if(!edgeVerified)blocks.push("Deployed Edge endpoints and membership checks remain unverified.");
  if(!browserVerified)blocks.push("No completed real-device two-to-four-player match has been verified.");
  return {
    staticSourceReady:urlValid&&keyPresent&&!missingMigrations.length&&scriptPresent,
    safeToDescribeAsLive:blocks.length===0,
    code:{publicConfigConfigured:urlValid&&keyPresent,
      migrationsPresent:missingMigrations.length===0,edgeFunctionPresent:scriptPresent},
    evidence:{separateExhibitionCatalogReviewed:catalogReady,
      authenticationTested:authVerified,edgeEndpointTested:edgeVerified,
      crossDeviceTested:browserVerified},
    blockers:blocks,
    warning:"Source files and disposable CI tests are not a deployed Supabase environment. This tool does not contact Supabase or validate credentials."
  };
}
