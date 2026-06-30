import "./globals.css";

export const metadata = {
  title: "HaydenOS",
  description: "Personal operating system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
