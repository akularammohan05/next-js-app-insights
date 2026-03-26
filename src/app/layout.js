import "./globals.css";

export const metadata = {
  title: "Integration Dashboard",
  description: "Execution Monitor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
