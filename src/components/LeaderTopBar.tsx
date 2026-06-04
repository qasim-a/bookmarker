import SignOutButton from "@/components/SignOutButton";

type Props = {
  clubName: string;
  userName?: string;
  memberLink?: string;
  appUrl?: string;
};

export default function LeaderTopBar({ clubName, userName, memberLink, appUrl }: Props) {
  return (
    <header className="topbar">
      <span className="topbar-brand">Bookmarker</span>
      <div className="topbar-spacer" />
      <nav className="topbar-nav">
        {memberLink && appUrl && (
          <a
            href={`${appUrl}/club/${memberLink}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Member link
          </a>
        )}
        {userName && (
          <span style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 8px" }}>
            {userName}
          </span>
        )}
        <SignOutButton />
      </nav>
    </header>
  );
}