'use client';
import type {ComponentProps} from 'react';
import {Button} from './button';
import './selection-button.css';

// Shared shape for selectable filters and view switches.
export function SelectionButton({className='', ...props}:ComponentProps<'button'>) {
 return <Button variant="outline" size="sm" type="button" className={'selection-button '+className} {...props}/>;
}
