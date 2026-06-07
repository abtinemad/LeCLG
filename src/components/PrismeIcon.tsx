import React from 'react';

/**
 * PrismeIcon — un prisme triangulaire 3D, trait façon lucide.
 *
 * Par défaut (`rainbow`), chacune des 6 arêtes prend une couleur du spectre
 * (rouge -> violet) : le prisme décompose la lumière. `rainbow={false}` =
 * trait monochrome qui suit la couleur du texte (currentColor / color / classes
 * text-*), utilisé là où la couleur porte un sens (couleur d'émotion).
 *
 * Drop-in d'une icône lucide : accepte size, color, strokeWidth, className,
 * style, et transmet tout autre prop SVG (title, onClick, aria-*, ...).
 */

interface PrismeIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  rainbow?: boolean;
}

// les 6 arêtes du prisme, chacune sa couleur (rouge -> violet, de gauche à droite)
const SEGMENTS: { d: string; color: string }[] = [
  { d: 'M8 7 L3 19', color: 'var(--color-heart)' },    // face avant — arête gauche
  { d: 'M3 19 L13 19', color: 'var(--color-clay)' },  // face avant — base
  { d: 'M13 19 L8 7', color: 'var(--color-ember)' },   // face avant — arête droite
  { d: 'M8 7 L16 4', color: 'var(--color-green)' },    // crête (profondeur)
  { d: 'M13 19 L21 16', color: 'var(--color-slate)' }, // arête droite (profondeur)
  { d: 'M16 4 L21 16', color: 'var(--color-plum)' },  // face arrière droite
];

const PrismeIcon: React.FC<PrismeIconProps> = ({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  rainbow = true,
  className,
  style,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    {...rest}
  >
    {rainbow ? (
      SEGMENTS.map((seg, i) => <path key={i} d={seg.d} stroke={seg.color} />)
    ) : (
      <>
        {/* face triangulaire avant */}
        <path d="M3 19 L13 19 L8 7 Z" />
        {/* arête de crête (profondeur) */}
        <path d="M8 7 L16 4" />
        {/* arête droite (profondeur) */}
        <path d="M13 19 L21 16" />
        {/* face arrière droite */}
        <path d="M16 4 L21 16" />
      </>
    )}
  </svg>
);

export default PrismeIcon;