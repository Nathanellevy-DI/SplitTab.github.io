import React, { useState, useRef } from 'react';

/**
 * SplitTab - A premium receipt splitting tool.
 * Refactored to use Vanilla CSS for a bespoke, high-end feel.
 */
export default function App() {
    const [step, setStep] = useState(1);
    const [items, setItems] = useState([]);
    const [people, setPeople] = useState([
        { id: 1, name: 'Person 1' },
        { id: 2, name: 'Person 2' }
    ]);
    const [tax, setTax] = useState(0);
    const [tip, setTip] = useState(0);
    const [tipType, setTipType] = useState('amount'); // 'amount' or 'percent'
    const [fees, setFees] = useState([]); // [{ id, name, value, type: 'amount'|'percent' }]
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Assignment state: { itemId: [personId, ...] }
    const [assignments, setAssignments] = useState({});

    const fileInputRef = useRef(null);

    // Helper to parse OCR text into items
    const parseOCRText = (text) => {
        const lines = text.split('\n');
        const parsedItems = [];
        const priceRegex = /^(.*?)\s*?\$?\s*?(\d+[.,]\d{2})\s*$/;

        // Keywords to ignore (case-insensitive)
        const ignoreKeywords = ['subtotal', 'total', 'tax', 'due', 'balance', 'items', 'amount'];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(priceRegex);
            if (match) {
                const name = match[1].trim();
                const price = parseFloat(match[2].replace(',', '.'));

                // Skip if the name contains any ignore keywords
                const shouldIgnore = ignoreKeywords.some(keyword =>
                    name.toLowerCase().includes(keyword.toLowerCase())
                );

                if (!shouldIgnore && name) {
                    parsedItems.push({ id: Date.now() + index, name, price });
                }
            }
        });

        setItems(parsedItems);
        const initialAssignments = {};
        parsedItems.forEach(item => { initialAssignments[item.id] = []; });
        setAssignments(initialAssignments);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setProgress(0);

        try {
            const { createWorker } = window.Tesseract;
            const worker = await createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                    }
                }
            });

            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            const { data: { text } } = await worker.recognize(file);
            await worker.terminate();

            parseOCRText(text);
            setStep(2);
        } catch (error) {
            console.error('OCR Error:', error);
            alert('Failed to process image. Please try again or add items manually.');
        } finally {
            setIsProcessing(false);
        }
    };

    const addItem = () => {
        const newItem = { id: Date.now(), name: '', price: 0 };
        setItems([...items, newItem]);
        setAssignments({ ...assignments, [newItem.id]: [] });
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const deleteItem = (id) => {
        setItems(items.filter(item => item.id !== id));
        const newAssignments = { ...assignments };
        delete newAssignments[id];
        setAssignments(newAssignments);
    };

    const addFee = () => {
        setFees([...fees, { id: Date.now(), name: 'Extra Fee', value: 0, type: 'percent' }]);
    };

    const updateFee = (id, field, value) => {
        setFees(fees.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const deleteFee = (id) => {
        setFees(fees.filter(f => f.id !== id));
    };

    const toggleAssignment = (itemId, personId) => {
        const current = assignments[itemId] || [];
        const updated = current.includes(personId)
            ? current.filter(id => id !== personId)
            : [...current, personId];
        setAssignments({ ...assignments, [itemId]: updated });
    };

    const addPerson = () => {
        if (people.length < 10) {
            setPeople([...people, { id: Date.now(), name: `Person ${people.length + 1}` }]);
        }
    };

    const updatePerson = (id, name) => {
        setPeople(people.map(p => p.id === id ? { ...p, name } : p));
    };

    const removePerson = (id) => {
        if (people.length > 2) {
            setPeople(people.filter(p => p.id !== id));
            const newAssignments = {};
            Object.keys(assignments).forEach(itemId => {
                newAssignments[itemId] = assignments[itemId].filter(pid => pid !== id);
            });
            setAssignments(newAssignments);
        }
    };

    const subtotal = items.reduce((acc, item) => acc + (parseFloat(item.price) || 0), 0);

    // Calculate global values
    const totalFees = fees.reduce((acc, f) => {
        const val = parseFloat(f.value) || 0;
        return acc + (f.type === 'percent' ? (subtotal * val / 100) : val);
    }, 0);
    const calculatedTip = tipType === 'percent' ? (subtotal * tip / 100) : parseFloat(tip);
    const total = subtotal + parseFloat(tax) + calculatedTip + totalFees;

    const calculateBreakdown = () => {
        return people.map(person => {
            let personSubtotal = 0;
            const personItems = [];

            items.forEach(item => {
                const assignedPeople = assignments[item.id] || [];
                if (assignedPeople.includes(person.id)) {
                    const share = (parseFloat(item.price) || 0) / assignedPeople.length;
                    personSubtotal += share;
                    personItems.push({ name: item.name, share });
                }
            });

            const ratio = subtotal > 0 ? personSubtotal / subtotal : 0;
            const personTax = parseFloat(tax) * ratio;
            const personTip = calculatedTip * ratio;
            const personFees = totalFees * ratio;
            const personTotal = personSubtotal + personTax + personTip + personFees;

            return {
                ...person,
                items: personItems,
                subtotal: personSubtotal,
                tax: personTax,
                tip: personTip,
                fees: personFees,
                total: personTotal
            };
        });
    };

    const copySummary = () => {
        const breakdown = calculateBreakdown();
        let text = "🏷️ SplitTab Receipt Summary\n\n";
        breakdown.forEach(p => {
            text += `👤 ${p.name}\n`;
            p.items.forEach(i => text += `  - ${i.name}: $${i.share.toFixed(2)}\n`);
            if (p.tax > 0) text += `  Tax: $${p.tax.toFixed(2)}\n`;
            if (p.tip > 0) text += `  Tip: $${p.tip.toFixed(2)}\n`;
            if (p.fees > 0) text += `  Fees: $${p.fees.toFixed(2)}\n`;
            text += `  Total: $${p.total.toFixed(2)}\n\n`;
        });
        text += `Subtotal: $${subtotal.toFixed(2)}\n`;
        if (parseFloat(tax) > 0) text += `Tax: $${parseFloat(tax).toFixed(2)}\n`;
        if (calculatedTip > 0) text += `Tip: $${calculatedTip.toFixed(2)}\n`;
        if (totalFees > 0) text += `Fees: $${totalFees.toFixed(2)}\n`;
        text += `Grand Total: $${total.toFixed(2)}`;
        navigator.clipboard.writeText(text);
        alert('Summary copied to clipboard!');
    };


    return (
        <div className="app-container">
            <div className="progress-stepper">
                <div className="progress-line"></div>
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`step-node ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                        {step > s ? '✓' : s}
                    </div>
                ))}
            </div>

            <header>
                <h1>SplitTab</h1>
                <p>Receipt splitting with precision</p>
            </header>

            {isProcessing && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="spinner"></div>
                        <p style={{ fontWeight: 800, marginTop: '1rem' }}>Processing Receipt...</p>
                        <p style={{ color: 'var(--text-muted)' }}>{progress}%</p>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="card animate-step" style={{ textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Step 1: Upload Receipt</h2>
                    <div
                        className="upload-zone"
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            border: '2px dashed var(--border)', borderRadius: '1rem',
                            padding: '3rem 1rem', cursor: 'pointer', transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</div>
                        <p style={{ fontWeight: 600 }}>Tap to scan image</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>or drag and drop here</p>
                        <input
                            type="file" ref={fileInputRef} className="hidden"
                            accept="image/*" onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </div>
                    <button
                        className="btn"
                        style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}
                        onClick={() => setStep(2)}
                    >
                        Skip to manual entry
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="animate-step">
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.25rem' }}>Step 2: Review Items</h2>
                            <button
                                className="btn"
                                style={{ background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={addItem}
                            >
                                + Add Item
                            </button>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            {items.map(item => (
                                <div key={item.id} className="item-row">
                                    <input
                                        className="input-field" type="text" value={item.name}
                                        placeholder="Item name" onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                    />
                                    <div className="price-input-wrapper">
                                        <span>$</span>
                                        <input
                                            className="input-field" type="number" step="0.01" value={item.price}
                                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                                        />
                                    </div>
                                    <button className="delete-btn" onClick={() => deleteItem(item.id)}>×</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(241, 245, 249, 0.5)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                                <span style={{ fontWeight: 700 }}>Subtotal</span>
                                <span style={{ fontWeight: 800 }}>${subtotal.toFixed(2)}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Tax</label>
                                    <div className="price-input-wrapper">
                                        <span>$</span>
                                        <input className="input-field" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Tip</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div className="price-input-wrapper" style={{ flex: 1 }}>
                                            <span>{tipType === 'amount' ? '$' : '%'}</span>
                                            <input className="input-field" type="number" value={tip} onChange={(e) => setTip(e.target.value)} />
                                        </div>
                                        <button
                                            className="btn" style={{ background: 'var(--primary)', color: 'white', width: '40px', padding: 0 }}
                                            onClick={() => setTipType(tipType === 'amount' ? 'percent' : 'amount')}
                                        >
                                            {tipType === 'amount' ? '$' : '%'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Extra Fees Section */}
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)' }}>Additional Fees</h3>
                                    <button className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', background: 'var(--primary)', color: 'white' }} onClick={addFee}>+ Add Fee</button>
                                </div>
                                {fees.map(fee => (
                                    <div key={fee.id} className="item-row" style={{ marginBottom: '0.5rem' }}>
                                        <input
                                            className="input-field" type="text" value={fee.name}
                                            onChange={(e) => updateFee(fee.id, 'name', e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div className="price-input-wrapper" style={{ flex: 1 }}>
                                                <span>{fee.type === 'amount' ? '$' : '%'}</span>
                                                <input className="input-field" type="number" value={fee.value} onChange={(e) => updateFee(fee.id, 'value', e.target.value)} />
                                            </div>
                                            <button
                                                className="btn" style={{ background: '#e2e8f0', width: '32px', padding: 0, fontSize: '0.75rem' }}
                                                onClick={() => updateFee(fee.id, 'type', fee.type === 'amount' ? 'percent' : 'amount')}
                                            >{fee.type === 'amount' ? '$' : '%'}</button>
                                        </div>
                                        <button className="delete-btn" onClick={() => deleteFee(fee.id)}>×</button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>Grand Total</span>
                                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-primary" disabled={items.length === 0} onClick={() => setStep(3)}>Next: Assign People</button>
                </div>
            )}

            {step === 3 && (
                <div className="animate-step">
                    <div className="card">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Step 3: Assign People</h2>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                            {people.map(p => (
                                <div key={p.id} style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem 1rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, width: '80px', outline: 'none' }}
                                        value={p.name} onChange={(e) => updatePerson(p.id, e.target.value)}
                                    />
                                    {people.length > 2 && (
                                        <button
                                            style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent', marginLeft: '0.5rem', cursor: 'pointer' }}
                                            onClick={() => removePerson(p.id)}
                                        >×</button>
                                    )}
                                </div>
                            ))}
                            {people.length < 10 && (
                                <button className="btn" style={{ background: '#f1f5f9', padding: '0.5rem 1rem' }} onClick={addPerson}>+ Add</button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            {items.map(item => (
                                <div key={item.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <span style={{ fontWeight: 700 }}>{item.name || "Unnamed Item"}</span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 800 }}>${(parseFloat(item.price) || 0).toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                                        {people.map(p => {
                                            const isAssigned = (assignments[item.id] || []).includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    className="btn"
                                                    style={{
                                                        background: isAssigned ? 'var(--primary)' : '#f1f5f9',
                                                        color: isAssigned ? 'white' : 'var(--text-muted)',
                                                        fontSize: '0.75rem', padding: '0.5rem'
                                                    }}
                                                    onClick={() => toggleAssignment(item.id, p.id)}
                                                >{p.name}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => setStep(4)}>Finally: View Summary</button>
                </div>
            )}

            {step === 4 && (
                <div className="animate-step">
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Step 4: Summary Breakdown</h2>
                    <div className="summary-grid">
                        {calculateBreakdown().map(p => (
                            <div key={p.id} className="card person-card">
                                <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{p.name}</h3>
                                <div style={{ marginBottom: '1rem' }}>
                                    {p.items.map((i, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{i.name}</span>
                                            <span style={{ fontWeight: 500 }}>${i.share.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span>Tax Share</span><span>${p.tax.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span>Tip Share</span><span>${p.tip.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                        <span>Fees Share</span><span>${p.fees.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700 }}>Total</span>
                                        <span className="summary-total">${p.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button className="btn" style={{ background: '#e2e8f0', flex: 1 }} onClick={() => setStep(3)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} onClick={copySummary}>Copy Summary</button>
                    </div>
                </div>
            )}

            <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', paddingBottom: '2rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Built with React & Precision</p>
            </footer>
        </div>
    );
}
