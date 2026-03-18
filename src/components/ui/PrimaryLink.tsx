import React from 'react'
import Link, { LinkProps } from 'next/link'

interface PrimaryLinkProps extends LinkProps {
  className?: string;
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  underline?: 'always' | 'hover' | 'none';
  color?: 'blue' | 'gray';
}

export const PrimaryLink: React.FC<PrimaryLinkProps> = ({
  className = '',
  children,
  size = 'sm', // Defaulting to sm as many instances used it
  underline = 'hover',
  color = 'blue',
  ...props
}) => {
  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const underlines = {
    always: 'underline',
    hover: 'hover:underline',
    none: 'no-underline',
  }

  const colors = {
    blue: 'text-blue-600 hover:text-blue-700',
    gray: 'text-gray-600 hover:text-white',
  }

  const baseStyles = 'transition-colors'
  const combinedClassName = `${baseStyles} ${colors[color]} ${sizes[size]} ${underlines[underline]} ${className}`.trim()

  return (
    <Link {...props} className={combinedClassName}>
      {children}
    </Link>
  )
}
