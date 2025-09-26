// Official South African Government Visual Assets
// This component contains SVG representations of government symbols

export function SouthAfricanCoatOfArms({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield */}
      <path
        d="M100 40 L140 60 L140 120 L100 150 L60 120 L60 60 Z"
        fill="#007749"
        stroke="#FCB514"
        strokeWidth="3"
      />
      
      {/* Rising Sun */}
      <circle cx="100" cy="80" r="20" fill="#FCB514" />
      <path
        d="M80 80 L120 80 M100 60 L100 100 M85 65 L115 95 M115 65 L85 95"
        stroke="#DE3831"
        strokeWidth="2"
      />
      
      {/* Protea Flowers */}
      <ellipse cx="70" cy="110" rx="12" ry="18" fill="#DE3831" />
      <ellipse cx="130" cy="110" rx="12" ry="18" fill="#DE3831" />
      
      {/* Spear and Knobkerrie crossed */}
      <line x1="50" y1="40" x2="150" y2="140" stroke="#000000" strokeWidth="3" />
      <line x1="150" y1="40" x2="50" y2="140" stroke="#000000" strokeWidth="3" />
      
      {/* Tusks */}
      <path
        d="M40 140 Q30 160 35 180"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M160 140 Q170 160 165 180"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
      />
      
      {/* Motto Ribbon */}
      <rect x="30" y="180" width="140" height="25" fill="#001489" rx="3" />
      <text
        x="100"
        y="197"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="bold"
        fontFamily="serif"
      >
        !KE E: /XARRA //KE
      </text>
      
      {/* Translation */}
      <text
        x="100"
        y="220"
        textAnchor="middle"
        fill="#000000"
        fontSize="9"
        fontFamily="sans-serif"
      >
        Unity in Diversity
      </text>
    </svg>
  );
}

export function DHALogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width="50"
        height="50"
        viewBox="0 0 50 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* DHA Shield */}
        <path
          d="M25 5 L40 12 L40 30 L25 42 L10 30 L10 12 Z"
          fill="#007749"
          stroke="#FCB514"
          strokeWidth="2"
        />
        
        {/* DHA Text */}
        <text
          x="25"
          y="28"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="14"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          DHA
        </text>
      </svg>
    </div>
  );
}

export function SecurityClassificationBanner({ 
  level = "OFFICIAL",
  className = "" 
}: { 
  level?: "OFFICIAL" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  className?: string;
}) {
  const colors = {
    "OFFICIAL": "bg-green-600",
    "CONFIDENTIAL": "bg-blue-600", 
    "SECRET": "bg-orange-600",
    "TOP SECRET": "bg-red-600"
  };

  return (
    <div className={`${colors[level]} text-white text-center py-1 text-xs font-bold tracking-wider ${className}`}>
      {level} - HANDLE WITH CARE
    </div>
  );
}

export function GovernmentWatermark({ text = "REPUBLIC OF SOUTH AFRICA" }: { text?: string }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center opacity-[0.03]">
      <div className="transform rotate-[-45deg] scale-150">
        <div className="text-gray-900 font-bold text-6xl tracking-widest">
          {text}
        </div>
        <div className="text-gray-900 font-bold text-4xl tracking-widest mt-4 text-center">
          DEPARTMENT OF HOME AFFAIRS
        </div>
      </div>
    </div>
  );
}

export function OfficialStamp({ 
  office = "PRETORIA",
  date = new Date().toLocaleDateString("en-ZA")
}: { 
  office?: string;
  date?: string;
}) {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="opacity-70">
      <circle
        cx="60"
        cy="60"
        r="55"
        fill="none"
        stroke="#DE3831"
        strokeWidth="4"
      />
      <circle
        cx="60"
        cy="60"
        r="45"
        fill="none"
        stroke="#DE3831"
        strokeWidth="2"
      />
      
      <text
        x="60"
        y="35"
        textAnchor="middle"
        fill="#DE3831"
        fontSize="10"
        fontWeight="bold"
      >
        REPUBLIC OF
      </text>
      <text
        x="60"
        y="50"
        textAnchor="middle"
        fill="#DE3831"
        fontSize="10"
        fontWeight="bold"
      >
        SOUTH AFRICA
      </text>
      
      <line x1="30" y1="55" x2="90" y2="55" stroke="#DE3831" strokeWidth="1" />
      
      <text
        x="60"
        y="70"
        textAnchor="middle"
        fill="#DE3831"
        fontSize="9"
        fontWeight="bold"
      >
        HOME AFFAIRS
      </text>
      <text
        x="60"
        y="82"
        textAnchor="middle"
        fill="#DE3831"
        fontSize="8"
      >
        {office}
      </text>
      <text
        x="60"
        y="95"
        textAnchor="middle"
        fill="#DE3831"
        fontSize="7"
      >
        {date}
      </text>
    </svg>
  );
}

export function POPIANotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
      <div className="flex items-start space-x-3">
        <svg
          className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h4 className="font-semibold text-blue-900 mb-1">
            Protection of Personal Information Act (POPIA) Notice
          </h4>
          <p className="text-blue-800">
            Your personal information is collected and processed in accordance with the 
            Protection of Personal Information Act 4 of 2013. This information will only 
            be used for the purposes of providing government services and will be protected 
            according to the highest security standards.
          </p>
          <p className="text-blue-700 mt-2 text-xs">
            For more information, visit www.justice.gov.za/inforeg
          </p>
        </div>
      </div>
    </div>
  );
}

export function GovernmentDisclaimer() {
  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-xs text-gray-600">
      <p className="font-semibold mb-2">IMPORTANT NOTICE:</p>
      <p className="mb-2">
        This is a demonstration system for the Department of Home Affairs services. 
        All information provided is for demonstration purposes only.
      </p>
      <p className="mb-2">
        The Republic of South Africa and the Department of Home Affairs accept no 
        liability for any loss or damage arising from the use of this system.
      </p>
      <p>
        For official services, please visit your nearest Home Affairs office or 
        the official website at www.dha.gov.za
      </p>
    </div>
  );
}