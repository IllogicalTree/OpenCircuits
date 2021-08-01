import path from "path";
import {ClassDeclaration, ConstructorDeclaration, FunctionDeclaration, JSDocParameterTag, JSDocReturnTag, MethodDeclaration, ParameterDeclaration, PropertyDeclaration, SyntaxKind, ts, Type} from "ts-morph";
import {AccessModifier, Types, Parameter, Property, Method, Constructor, Class} from "./model";


export function getAccessModifier(d: ConstructorDeclaration | PropertyDeclaration | MethodDeclaration | FunctionDeclaration): AccessModifier {
    const modifiers = d?.getModifiers() ?? [];
    if (modifiers.find(m => m.getKind() === SyntaxKind.PublicKeyword))
        return "public";
    if (modifiers.find(m => m.getKind() === SyntaxKind.ProtectedKeyword))
        return "protected";
    if (modifiers.find(m => m.getKind() === SyntaxKind.PrivateKeyword))
        return "private";
    return "public"; // Default modifier
}


export function getType(t: Type<ts.Type>): Types {
    const parseUrl = (url: string) =>
        path.resolve("/ts", path.relative(path.resolve(process.cwd(), "src"), url));
    return t.getText()
        .split("|")
        .map(t =>
            t.split("&")
            .map(t2 => {
                const matches = Array.from(t2.matchAll(/import\(\"([a-zA-Z0-9\/]+)\"\).([a-zA-Z0-9]+)/g));
                if (matches.length === 0)
                    return {name: t2};
                if (matches.length !== 1)
                    throw new Error(`Received multiple type matches for: ${t2}!`);
                const [_, link, name] = matches[0];
                return { name, link: parseUrl(link) };
            })
        );
}


export function getParameter(p: ParameterDeclaration): Parameter {
    const parent = p.getParent() as MethodDeclaration | ConstructorDeclaration;
    const jsDocs = parent.getJsDocs();
    if (jsDocs.length > 1)
        console.trace(`Found JSDoc with length > 1 !!: ${p.getName()}`);
    return {
        docs: jsDocs[0]
            ?.getTags()
            ?.filter(t => t instanceof JSDocParameterTag)
            ?.find(t => (t as JSDocParameterTag).getName() === p.getName())
            ?.getCommentText(),
        name: p.getName(),
        type: getType(p.getType()),
    };
}


export function getConstructors(c: ClassDeclaration): Constructor {
    if (c.getConstructors().length > 1)
        throw new Error(`Multiple constructors not supported for ${c.getName()}!`);
    const cc = c.getConstructors()[0];
    const jsDocs = cc.getJsDocs();
    if (jsDocs.length > 1)
        console.trace(`Found JSDoc with length > 1 !!: ${c.getName()}`);
    return {
        docs: jsDocs[0]?.getDescription(),
        access: getAccessModifier(cc),
        // If no overloads, then just use the single constructor declaration `cc`
        overloads: (cc.getOverloads().length > 0 ? cc.getOverloads() : [cc])
            .map(c => ({
                docs: c.getJsDocs()[0]?.getDescription(),
                parameters: c.getParameters().map(getParameter),
            })),
    };
}


export function getProperties(c: ClassDeclaration): Property[] {
    return c.getProperties().map(p => ({
        docs: p.getJsDocs()[0]?.getDescription(),
        access: getAccessModifier(p),
        name: p.getName(),
        type: getType(p.getType()),
    }));
}


export function parseMethods(methods: (MethodDeclaration | FunctionDeclaration)[]): Method[] {
    const parseMethod = (m: MethodDeclaration | FunctionDeclaration) => ({
        docs: m.getJsDocs()[0]?.getDescription(),
        parameters: m.getParameters().map(getParameter),
        returns: (() => {
            // Filter JSDocs for return tags and use those for return statements
            const returns = m.getJsDocs()[0]
                ?.getTags()
                ?.filter(t => t instanceof JSDocReturnTag)
                ?.map(t => ({
                    docs: (t as JSDocReturnTag).getCommentText(),
                    type: getType(m.getReturnType()),
                })) ?? [];
            // If no JSDoc return statements found, just use the default return
            return returns.length === 0 ? [{ type: getType(m.getReturnType()) }] : returns;
        })(),
    });

    return methods
        .map(m => ({
            docs: m.getJsDocs()[0]?.getDescription(),
            access: getAccessModifier(m),
            name: m.getName() ?? "(undefined)",
            implementation: parseMethod(m),
            overloads: (m.getOverloads() ?? []).map(parseMethod)
        }));
}


export function parseClass(c: ClassDeclaration): Class {
    const jsDocs = c.getJsDocs();
    if (jsDocs.length > 1)
        console.trace(`Found JSDoc with length > 1 !!: ${c.getName()}`);
    return {
        docs: jsDocs[0]?.getDescription(),
        generics: c.getTypeParameters()?.map(t => ({
            docs: c.getJsDocs()[0]
                ?.getTags()
                ?.filter(p => p instanceof JSDocParameterTag)
                ?.find(p => (p as JSDocParameterTag).getName() === t.getName())
                ?.getCommentText(),
            constraint: t.getConstraint() ? getType(t.getConstraint()!.getType()) : undefined,
            name: t.getName(),
        })),
        name: c.getName()!,
        constructor: getConstructors(c),
        properties: getProperties(c),
        methods: parseMethods(c.getInstanceMethods()),
        staticMethods: parseMethods(c.getStaticMethods()),
    };
}
