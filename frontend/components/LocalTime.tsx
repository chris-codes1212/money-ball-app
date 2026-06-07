"use client";

import {useState, useEffect} from 'react';

export default function LocalTime({time}:{time:string}){
    
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }
    return <span>{new Date(time).toLocaleString([], { hour: 'numeric', minute: '2-digit' })}</span>;

}