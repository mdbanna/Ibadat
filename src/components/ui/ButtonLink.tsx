import { Link, type LinkProps } from 'react-router-dom'
import { buttonClasses, type ButtonVariant } from './Button'

interface Props extends LinkProps {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  fullWidth?: boolean
}

/** A router link that looks like a Button. Use for navigation; use <Button> for actions. */
export function ButtonLink({ variant = 'primary', size = 'md', fullWidth, className, ...rest }: Props) {
  return <Link className={buttonClasses(variant, size, fullWidth, className)} {...rest} />
}
