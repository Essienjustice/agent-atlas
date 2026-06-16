import ProfileClient from "./profile-client";
import Nav from "../../components/Nav";

export default function ProfilePage() {
  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <ProfileClient />
      </div>
    </main>
  );
}
