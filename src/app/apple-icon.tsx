import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#14001f",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="132" height="132" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="11" fill="none" stroke="#9eecff" strokeWidth="2" />
          <path
            fill="#e400ff"
            d="M16 6.2c1.5 4.4 5.4 7.2 5.4 12.4 0 5.5-2.7 9.4-5.4 11.5-2.7-2.1-5.4-6-5.4-11.5 0-5.2 3.9-8 5.4-12.4z"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
