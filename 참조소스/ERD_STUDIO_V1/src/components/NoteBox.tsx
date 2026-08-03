import React, { useState } from 'react';
import { Note } from '../types/schema';
import { useSchemaStore } from '../store/schemaStore';

interface Props {
  note: Note;
}

const NoteBox: React.FC<Props> = ({ note }) => {
  const { updateNote, deleteNote } = useSchemaStore();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(note.text);

  const handleBlur = () => {
    setIsEditing(false);
    updateNote(note.id, { text });
  };

  return (
    <div
      className="note-box"
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
        width: note.width,
        minHeight: note.height,
        background: 'rgba(255, 193, 7, 0.15)',
        border: '1px solid rgba(255, 193, 7, 0.4)',
        borderRadius: 8,
        padding: 12,
        color: '#ffc107',
        fontSize: 13,
        cursor: 'move',
        zIndex: 5
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {isEditing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: 'inherit',
            resize: 'none',
            outline: 'none'
          }}
        />
      ) : (
        <div>{note.text}</div>
      )}
      <button
        onClick={() => deleteNote(note.id)}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'none',
          border: 'none',
          color: '#ffc107',
          cursor: 'pointer',
          fontSize: 12
        }}
      >
        ×
      </button>
    </div>
  );
};

export default NoteBox;
