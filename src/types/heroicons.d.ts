declare module '@heroicons/react/24/outline' {
    export const ChevronDownIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const ChevronUpIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const MagnifyingGlassIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const PlusIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const XMarkIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

declare module '@heroicons/react/24/solid' {
    export const ChevronDownIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const MagnifyingGlassIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const PlusIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const XMarkIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

declare module '@heroicons/react/24/mini' {
    export const ChevronDownIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const MagnifyingGlassIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const PlusIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    export const XMarkIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

declare module 'react-xarrows' {
    interface XarrowProps {
        start: string;
        end: string;
        color?: string;
        strokeWidth?: number;
        curveness?: number;
        startAnchor?: string;
        endAnchor?: string;
    }
    const Xarrow: React.FC<XarrowProps>;
    export default Xarrow;
} 